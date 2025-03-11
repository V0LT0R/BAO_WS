# Bao Web Service

Bao Web site is a web service deployed on the Render platform that provides an information about Biloshchytskyi Andrii Oleksandrovich

## Demo

The project is available at the following link: [Bao Web Site](https://bao-ws.onrender.com/)

## Installation and Setup

### 1. Clone the Repository

```sh
git clone https://github.com/V0LT0R/BAO_WS
cd bao_ws
```

### 2. Install Dependencies

```sh
npm install
```

### 3. Configuration

Create a `.env` file and add the required environment variables:

```
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```

### 4. Start the Server

```sh
npm start
```

The server will start at `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/user/register` - User registration
- `POST /api/user/login` - User login

### Management
- `GET /api/experience` - Retrieve a list of tasks
- `POST /api/experience` - Create a new task
- `PUT /api/experience/:id` - Update a task
- `DELETE /api/experience/:id` - Delete a task

## Technologies

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT (JSON Web Token) for authentication

## Author

[Yevhenii Biloshchytskyi] - [GitHub]((https://github.com/V0LT0R))
[Artem Biloshchytskyi] - [GitHub](https://github.com/Nev1L-69)
[Nursaya Batyr] - [GitHub]((https://github.com/Nursaya0))


