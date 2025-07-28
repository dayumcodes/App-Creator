import { PrismaClient, FileType } from '../src/generated/prisma';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create test users
  const hashedPassword = await bcrypt.hash('password123', 10);

  const user1 = await prisma.user.upsert({
    where: { email: 'john@example.com' },
    update: {},
    create: {
      email: 'john@example.com',
      username: 'john_doe',
      passwordHash: hashedPassword,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'jane@example.com' },
    update: {},
    create: {
      email: 'jane@example.com',
      username: 'jane_smith',
      passwordHash: hashedPassword,
    },
  });

  console.log('✅ Created test users');

  // Create test projects
  const project1 = await prisma.project.upsert({
    where: { id: 'project-1' },
    update: {},
    create: {
      id: 'project-1',
      name: 'Todo App',
      description: 'A simple todo application built with vanilla JavaScript',
      userId: user1.id,
    },
  });

  const project2 = await prisma.project.upsert({
    where: { id: 'project-2' },
    update: {},
    create: {
      id: 'project-2',
      name: 'Weather Dashboard',
      description: 'A weather dashboard with API integration',
      userId: user1.id,
    },
  });

  const project3 = await prisma.project.upsert({
    where: { id: 'project-3' },
    update: {},
    create: {
      id: 'project-3',
      name: 'Portfolio Website',
      description: 'A personal portfolio website',
      userId: user2.id,
    },
  });

  console.log('✅ Created test projects');

  // Create test project files
  const todoHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Todo App</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <h1>Todo App</h1>
        <div class="input-section">
            <input type="text" id="todoInput" placeholder="Add a new todo...">
            <button id="addBtn">Add</button>
        </div>
        <ul id="todoList"></ul>
    </div>
    <script src="script.js"></script>
</body>
</html>`;

  const todoCss = `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: Arial, sans-serif;
    background-color: #f4f4f4;
    padding: 20px;
}

.container {
    max-width: 600px;
    margin: 0 auto;
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

h1 {
    text-align: center;
    color: #333;
    margin-bottom: 20px;
}

.input-section {
    display: flex;
    margin-bottom: 20px;
}

#todoInput {
    flex: 1;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px 0 0 4px;
}

#addBtn {
    padding: 10px 20px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 0 4px 4px 0;
    cursor: pointer;
}

#addBtn:hover {
    background: #0056b3;
}

#todoList {
    list-style: none;
}

.todo-item {
    display: flex;
    align-items: center;
    padding: 10px;
    border-bottom: 1px solid #eee;
}

.todo-item.completed {
    text-decoration: line-through;
    opacity: 0.6;
}

.delete-btn {
    margin-left: auto;
    background: #dc3545;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
}`;

  const todoJs = `class TodoApp {
    constructor() {
        this.todos = [];
        this.todoInput = document.getElementById('todoInput');
        this.addBtn = document.getElementById('addBtn');
        this.todoList = document.getElementById('todoList');
        
        this.init();
    }
    
    init() {
        this.addBtn.addEventListener('click', () => this.addTodo());
        this.todoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTodo();
        });
    }
    
    addTodo() {
        const text = this.todoInput.value.trim();
        if (!text) return;
        
        const todo = {
            id: Date.now(),
            text,
            completed: false
        };
        
        this.todos.push(todo);
        this.todoInput.value = '';
        this.render();
    }
    
    toggleTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.completed = !todo.completed;
            this.render();
        }
    }
    
    deleteTodo(id) {
        this.todos = this.todos.filter(t => t.id !== id);
        this.render();
    }
    
    render() {
        this.todoList.innerHTML = '';
        
        this.todos.forEach(todo => {
            const li = document.createElement('li');
            li.className = \`todo-item \${todo.completed ? 'completed' : ''}\`;
            li.innerHTML = \`
                <input type="checkbox" \${todo.completed ? 'checked' : ''} 
                       onchange="app.toggleTodo(\${todo.id})">
                <span>\${todo.text}</span>
                <button class="delete-btn" onclick="app.deleteTodo(\${todo.id})">Delete</button>
            \`;
            this.todoList.appendChild(li);
        });
    }
}

const app = new TodoApp();`;

  await prisma.projectFile.createMany({
    data: [
      {
        projectId: project1.id,
        filename: 'index.html',
        content: todoHtml,
        type: FileType.HTML,
      },
      {
        projectId: project1.id,
        filename: 'styles.css',
        content: todoCss,
        type: FileType.CSS,
      },
      {
        projectId: project1.id,
        filename: 'script.js',
        content: todoJs,
        type: FileType.JS,
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Created test project files');

  // Create test prompt history
  await prisma.promptHistory.createMany({
    data: [
      {
        projectId: project1.id,
        prompt: 'Create a simple todo app with HTML, CSS, and JavaScript',
        response: 'I\'ll create a todo app with the following features: add todos, mark as complete, delete todos, and responsive design.',
        filesChanged: ['index.html', 'styles.css', 'script.js'],
      },
      {
        projectId: project1.id,
        prompt: 'Add a counter showing total and completed todos',
        response: 'I\'ll add a counter display at the top showing the total number of todos and how many are completed.',
        filesChanged: ['index.html', 'styles.css', 'script.js'],
      },
      {
        projectId: project2.id,
        prompt: 'Create a weather dashboard that shows current weather and 5-day forecast',
        response: 'I\'ll create a weather dashboard using a weather API to display current conditions and a 5-day forecast with icons and temperatures.',
        filesChanged: ['index.html', 'styles.css', 'script.js'],
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Created test prompt history');

  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });