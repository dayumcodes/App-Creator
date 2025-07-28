# Database Setup and Usage

This document describes the database schema, setup process, and usage for the Lovable Clone backend.

## Database Schema

The application uses PostgreSQL with Prisma ORM. The schema includes the following models:

### User
- `id`: Unique identifier (CUID)
- `email`: User's email address (unique)
- `username`: User's username (unique)
- `passwordHash`: Hashed password using bcrypt
- `createdAt`: Account creation timestamp
- `updatedAt`: Last update timestamp

### Project
- `id`: Unique identifier (CUID)
- `userId`: Reference to the user who owns the project
- `name`: Project name
- `description`: Optional project description
- `createdAt`: Project creation timestamp
- `updatedAt`: Last update timestamp

### ProjectFile
- `id`: Unique identifier (CUID)
- `projectId`: Reference to the parent project
- `filename`: File name (unique within project)
- `content`: File content as text
- `type`: File type enum (HTML, CSS, JS, JSON, TS, TSX, JSX)
- `createdAt`: File creation timestamp
- `updatedAt`: Last update timestamp

### PromptHistory
- `id`: Unique identifier (CUID)
- `projectId`: Reference to the parent project
- `prompt`: User's input prompt
- `response`: AI's response description
- `filesChanged`: Array of filenames that were modified
- `createdAt`: Prompt timestamp

## Setup Instructions

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database running (or use Prisma dev server)

### Environment Configuration
Create a `.env` file in the backend directory with:

```env
# Database
DATABASE_URL="postgres://username:password@localhost:5432/lovable_clone"

# JWT Secret
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# OpenAI API Key (for AI code generation)
OPENAI_API_KEY="your-openai-api-key"

# Server Configuration
PORT=3001
NODE_ENV=development
```

### Database Initialization

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Initialize database:**
   ```bash
   npm run db:init
   ```
   This script will:
   - Generate Prisma client
   - Apply database migrations
   - Seed the database with sample data

3. **Alternative manual setup:**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Apply migrations
   npm run db:migrate
   
   # Seed database
   npm run db:seed
   ```

## Available Scripts

- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data
- `npm run db:reset` - Reset database (WARNING: destroys all data)
- `npm run db:studio` - Open Prisma Studio for database inspection
- `npm run db:init` - Complete database initialization

## Usage Examples

### Database Service
The `DatabaseService` class provides high-level database operations:

```typescript
import { databaseService } from './services/DatabaseService';

// Connect to database
await databaseService.connect();

// Create a user
const user = await databaseService.createUser({
  email: 'user@example.com',
  username: 'username',
  passwordHash: 'hashed_password'
});

// Create a project
const project = await databaseService.createProject({
  userId: user.id,
  name: 'My Project',
  description: 'A sample project'
});

// Create project files
await databaseService.createProjectFile({
  projectId: project.id,
  filename: 'index.html',
  content: '<html><body>Hello World</body></html>',
  type: 'HTML'
});
```

### Repository Pattern
Direct repository access for more granular control:

```typescript
import { userRepository, projectRepository } from './repositories';

// Find user by email
const user = await userRepository.findByEmail('user@example.com');

// Get user's projects
const projects = await projectRepository.findByUser({
  userId: user.id,
  page: 1,
  limit: 10
});
```

### Transactions
Use transactions for operations that need to be atomic:

```typescript
import { withTransaction } from './lib/database';

const result = await withTransaction(async (tx) => {
  const project = await projectRepository.create(projectData);
  const files = await Promise.all(
    fileData.map(file => projectFileRepository.create({
      ...file,
      projectId: project.id
    }))
  );
  return { project, files };
});
```

## Error Handling

The database layer includes custom error types:

- `DatabaseError`: Base database error
- `NotFoundError`: Resource not found
- `DuplicateError`: Unique constraint violation

```typescript
try {
  const user = await databaseService.getUserById('invalid-id');
} catch (error) {
  if (error instanceof NotFoundError) {
    // Handle not found
  } else if (error instanceof DuplicateError) {
    // Handle duplicate
  }
}
```

## Testing

Run database tests:

```bash
npm test -- database.test.ts
```

The test suite includes:
- Connection health checks
- CRUD operations for all models
- Transaction testing
- Error handling validation

## Performance Considerations

- Database connections use connection pooling
- Indexes are created on frequently queried fields
- Pagination is implemented for large result sets
- Transactions are used for multi-table operations

## Security

- All user inputs are validated through Prisma
- Passwords are hashed using bcrypt
- Database queries use parameterized statements
- Foreign key constraints ensure data integrity