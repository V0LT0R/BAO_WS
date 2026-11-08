import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ResourceManager, resources } from './ResourceManager.jsx';
import { ProfileForm } from './Auth.jsx';
import { api } from '../lib/api.js';

vi.mock('../lib/api.js', async importOriginal => ({ ...(await importOriginal()), api: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('content editing', () => {
  it('can change a legacy account password without forcing a username rename', async () => {
    const user = { _id: 'legacy', username: 'Legacy User', role: 'user' };
    const onUpdate = vi.fn();
    api.mockResolvedValueOnce({ user });
    render(<ProfileForm user={user} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit user' }));
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'old-password' } });
    fireEvent.change(screen.getByLabelText('New password (leave blank to keep current)'), { target: { value: 'new-long-password' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Edit account' }));
    await screen.findByText('Account updated.');
    expect(api).toHaveBeenCalledWith('/api/user/legacy', { method: 'PUT', body: { currentPassword: 'old-password', newPassword: 'new-long-password' } });
    expect(onUpdate).toHaveBeenCalledWith(user);
  });
  it('retains the draft after a server error and sends plain bilingual data', async () => {
    api.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('Your session expired.'));
    render(<ResourceManager resource={resources[0]} />);
    await screen.findByText('No experience entries yet.');
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2026' } });
    fireEvent.change(screen.getByLabelText('Description (English)'), { target: { value: "Professor's <script>alert(1)</script>" } });
    fireEvent.change(screen.getByLabelText('Description (Ukrainian)'), { target: { value: 'Наукова діяльність' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Add Experience' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Your session expired.');
    expect(screen.getByLabelText('Description (English)').value).toContain('<script>');
    expect(api).toHaveBeenLastCalledWith('/api/experience', { method: 'POST', body: { year: '2026', descriptionEn: "Professor's <script>alert(1)</script>", descriptionUa: 'Наукова діяльність' } });
  });
  it('does not delete until the user confirms the specific entry', async () => {
    api.mockResolvedValueOnce([{ _id: 'a', year: '2026', descriptionEn: '<img src=x onerror=alert(1)>', descriptionUa: 'Текст' }]).mockResolvedValueOnce({}).mockResolvedValueOnce([]);
    render(<ResourceManager resource={resources[0]} />);
    await screen.findByText('<img src=x onerror=alert(1)>');
    expect(document.querySelector('img')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Delete', exact: true }));
    expect(api).toHaveBeenCalledTimes(1);
    const confirmation = screen.getByRole('group', { name: 'Confirm deletion' });
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Confirm delete' }));
    await screen.findByText('Experience deleted.');
    expect(api).toHaveBeenCalledWith('/api/experience/a', { method: 'DELETE' });
  });
  it('rejects active-content uploads without submitting to the API', async () => {
    api.mockResolvedValueOnce([]);
    render(<ResourceManager resource={resources[3]} />);
    await screen.findByText('No certificate entries yet.');
    fireEvent.change(screen.getByLabelText('Date of Issue'), { target: { value: '2026' } });
    for (const language of ['English', 'Ukrainian']) fireEvent.change(screen.getByLabelText(`Description (${language})`), { target: { value: 'Certificate' } });
    fireEvent.change(screen.getByLabelText('Certificate Image'), { target: { files: [new File(['<svg onload="alert(1)"/>'], 'bad.svg', { type: 'image/svg+xml' })] } });
    fireEvent.submit(screen.getByRole('form', { name: 'Add Certificate' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Choose a JPEG, PNG or WebP image no larger than 5 MB.');
    expect(api).toHaveBeenCalledTimes(1);
  });
  it('sends a multipart certificate and clears fields only after success', async () => {
    api.mockResolvedValueOnce([]).mockResolvedValueOnce({ _id: 'certificate' }).mockResolvedValueOnce([]);
    render(<ResourceManager resource={resources[3]} />);
    await screen.findByText('No certificate entries yet.');
    fireEvent.change(screen.getByLabelText('Date of Issue'), { target: { value: '2026-11-08' } });
    fireEvent.change(screen.getByLabelText('Description (English)'), { target: { value: 'Certificate' } });
    fireEvent.change(screen.getByLabelText('Description (Ukrainian)'), { target: { value: 'Сертифікат' } });
    fireEvent.change(screen.getByLabelText('Certificate Image'), { target: { files: [new File(['test-image'], 'test.png', { type: 'image/png' })] } });
    fireEvent.submit(screen.getByRole('form', { name: 'Add Certificate' }));
    await screen.findByText('Certificate added.');
    const [, request] = api.mock.calls[1];
    expect(request.body.get('descriptionUa')).toBe('Сертифікат');
    expect(request.body.get('image').name).toBe('test.png');
    await waitFor(() => expect(screen.getByLabelText('Date of Issue').value).toBe(''));
  });
});
