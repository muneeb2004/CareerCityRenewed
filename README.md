# Career City 2026

A [Next.js](https://nextjs.org) application for managing student registrations, booth visits, and feedback collection at the Career City 2026 career fair event.

## Tech Stack

- **Frontend:** Next.js 14 with React Server Components
- **Backend:** Next.js Server Actions
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** JWT-based staff authentication
- **Testing:** Jest with MongoMemoryReplSet for integration tests

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- MongoDB Atlas account (or local MongoDB instance)

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/your_username_/career-city-2026.git
   ```

2. Install NPM packages
   ```sh
   npm install
   ```

### Environment Variables

Create a `.env.local` file in the root of the project with the following variables:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/careercity?retryWrites=true&w=majority
JWT_SECRET=your-secret-key-here
```

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```
src/
├── actions/        # Next.js Server Actions (MongoDB operations)
├── components/     # React components
├── lib/            # Utilities (db connection, auth, etc.)
├── models/         # Mongoose schemas
└── types/          # TypeScript type definitions

app/
├── staff/          # Staff dashboard pages
├── student/        # Student registration pages
└── volunteer/      # Volunteer feedback pages

__tests__/
├── actions/        # Unit tests for server actions
└── integration/    # End-to-end flow tests
```

## Available Scripts

### `npm run dev`

Runs the app in development mode at [http://localhost:3000](http://localhost:3000).

### `npm test`

Launches the Jest test runner with 71 comprehensive tests covering:
- Server action unit tests (CRUD operations, transactions)
- Integration tests (complete user flows)
- UI component tests

### `npm run build`

Builds the app for production.

### `npm run start`

Starts the production server.

### `npm run lint`

Runs ESLint to check for code quality issues.
