# Travel Journal App

A full-stack MERN application for creating and managing travel journals.

## Features

- User authentication (register/login)
- Create, read, update, and delete travel journals
- Modern UI with Material-UI components
- Responsive design

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

## Setup

1. Clone the repository
2. Install backend dependencies:
   ```bash
   npm install
   ```
3. Install frontend dependencies:
   ```bash
   cd client
   npm install
   ```
4. Create a .env file in the root directory with the following variables:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/travel-journal
   JWT_SECRET=your-secret-key-here
   ```

## Running the Application

1. Start the backend server:
   ```bash
   npm run dev
   ```
2. Start the frontend development server:
   ```bash
   cd client
   npm start
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## API Endpoints

### Authentication
- POST /api/auth/register - Register a new user
- POST /api/auth/login - Login user

### Journals
- GET /api/journals - Get all journals for the authenticated user
- POST /api/journals - Create a new journal
- GET /api/journals/:id - Get a specific journal
- PATCH /api/journals/:id - Update a journal
- DELETE /api/journals/:id - Delete a journal 