# Career City 2026

This is a [Next.js](https://nextjs.org) project for managing student and organization feedback at the Career City 2026 event.

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

*   npm
    ```sh
    npm install npm@latest -g
    ```

### Installation

1.  Clone the repo
    ```sh
    git clone https://github.com/your_username_/your_repository_name.git
    ```
2.  Install NPM packages
    ```sh
    npm install
    ```

### Environment Variables

To run the project, you need to set up the environment variables for Firebase.

1.  Create a `.env.local` file in the root of the project.
2.  Copy the contents of `.env.example` into the `.env.local` file.
3.  Fill in the values for the Firebase configuration.

### Running the Development Server

Once you have installed the dependencies and set up the environment variables, you can run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Firebase Security Rules

This project includes a `firestore.rules` file with role-based security rules for Firestore. To deploy these rules to your Firebase project, you can use the Firebase CLI.

1.  Install the Firebase CLI if you haven't already:
    ```sh
    npm install -g firebase-tools
    ```
2.  Login to Firebase:
    ```sh
    firebase login
    ```
3.  Deploy the Firestore rules:
    ```sh
    firebase deploy --only firestore:rules
    ```

**Disclaimer:** The provided security rules assume that you have a `users` collection in Firestore where each document has the user's UID as the document ID and a `role` field. The `role` field can be `'admin'`, `'coordinator'`, `'volunteer'`, or `'student'`. You should review and adapt these rules to your specific security needs. For more information on writing Firestore security rules, please refer to the [official documentation](https://firebase.google.com/docs/firestore/security/get-started).

## Available Scripts

In the project directory, you can run:

### `npm run dev`

Runs the app in the development mode.
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### `npm test`

Launches the test runner in the interactive watch mode.

### `npm run build`

Builds the app for production to the `.next` folder.

### `npm run start`

Starts a Next.js production server.

### `npm run lint`

Runs the linter to check for code quality issues.
