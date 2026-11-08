import React from 'react';

export function FormFeedback({ error, message }) {
  return <>
    {error && <p className="alert alert-danger mt-3" role="alert">{error}</p>}
    {message && <p className="alert alert-success mt-3" role="status">{message}</p>}
  </>;
}
