import type { ScaffoldOptions } from './scaffold.js';

/**
 * Heuristics-based skill generator.
 * Analyzes the user's tech stack and feature requests to dynamically scaffold targeted Executable Memory skill files.
 */
export function generateDynamicSkills(opts: ScaffoldOptions): Record<string, string> {
    const skills: Record<string, string> = {};
    const stack = (opts.techStack || '').toLowerCase();
    const features = (opts.keyFeatures || []).map(f => f.toLowerCase());
    
    // Default wildcard inclusion if no stack is provided but we still want a template
    if (!stack && features.length === 0) {
        skills['skills/example_feature.md'] = generateGenericSkill();
        return skills;
    }

    // --- FRONTEND FRAMEWORKS ---
    if (stack.includes('react') || stack.includes('next.js') || stack.includes('nextjs')) {
        skills['skills/react_ui_guidelines.md'] = generateReactSkill();
    }
    if (stack.includes('vue') || stack.includes('nuxt')) {
        skills['skills/vue_ui_guidelines.md'] = generateVueSkill();
    }

    // --- BACKEND LOGIC ---
    if (stack.includes('node') || stack.includes('express') || stack.includes('nestjs')) {
        skills['skills/node_api_routes.md'] = generateNodeSkill();
    }
    if (stack.includes('python') || stack.includes('fastapi') || stack.includes('django')) {
        skills['skills/python_backend.md'] = generatePythonSkill();
    }

    // --- DATABASE / ORM ---
    if (stack.includes('sql') || stack.includes('postgres') || stack.includes('mysql') || stack.includes('supabase')) {
        skills['skills/database_schema_rules.md'] = generateSqlSkill();
    }
    if (stack.includes('mongo') || stack.includes('nosql')) {
        skills['skills/mongodb_queries.md'] = generateMongoSkill();
    }

    // --- FEATURE SPECIFIC ---
    const featureString = features.join(' ');
    if (featureString.includes('auth') || featureString.includes('login') || featureString.includes('sign in')) {
        skills['skills/authentication_flow.md'] = generateAuthSkill();
    }

    return skills;
}

function generateReactSkill(): string {
    return `# React & Next.js UI Skill

> **AI INSTRUCTION**: Apply these rules when building Frontend UI components.

## Core Architecture
- **Hooks over Classes**: Never use Class Components. Always use functional components and hooks.
- **Server vs Client**: In Next.js App Router, default to Server Components. Only add \`"use client"\` when you explicitly need React state or browser APIs.

## Styling
- Prefer utility-first CSS (Tailwind) if installed, otherwise use Vanilla CSS Modules.
- Do not use inline styles unless absolutely necessary for dynamic layout calculations.

## State Management
- Keep state as close to the UI as possible.
- Avoid massive global contexts unless passing theme or user data deeply.
`;
}

function generateVueSkill(): string {
    return `# Vue 3 UI Skill

> **AI INSTRUCTION**: Apply these rules when building Vue components.

## Core Architecture
- **Composition API**: Always use the \`<script setup>\` syntax. Do not use the Options API.
- Use \`ref()\` for primitives and \`reactive()\` for objects.

## Styling
- Use \`<style scoped>\` to prevent CSS bleed.
`;
}

function generateNodeSkill(): string {
    return `# Node.js API Skill

> **AI INSTRUCTION**: Apply these rules when building backend API routes.

## Core Architecture
- Never block the Event Loop. Use \`async/await\` cleanly.
- Keep route handlers thin. Extract heavy business logic into a \`services/\` directory.
- Always use proper HTTP status codes.

## Error Handling
- Never silence errors. Catch and format them into standardized JSON error responses.
`;
}

function generatePythonSkill(): string {
    return `# Python Backend Skill

> **AI INSTRUCTION**: Apply these rules when building the Python API.

## Core Architecture
- Use Type Hints (\`def fetch_user(user_id: int) -> dict:\`) religiously.
- If using FastAPI, use Pydantic models for explicit request/response validation.

## Formatting
- The project enforces Black formatting and strict PEP-8.
`;
}

function generateSqlSkill(): string {
    return `# Database & SQL Skill

> **AI INSTRUCTION**: Apply these rules when interacting with the database.

## Schema Rules
- All tables must have an \`id\` primary key (UUID or BigInt auto-increment), a \`created_at\`, and \`updated_at\` timestamp.
- Never use \`SELECT *\` in production code. Explicitly name the columns you need.

## Security
- Always use parameterized queries or an ORM/Query Builder to prevent SQL injection.
`;
}

function generateMongoSkill(): string {
    return `# MongoDB Skill

> **AI INSTRUCTION**: Apply these rules when writing NoSQL queries.

## Architecture
- Do not overly normalize data. Embed documents where data is frequently read together.
- Ensure all queries are covered by appropriate indexes.
`;
}

function generateAuthSkill(): string {
    return `# Authentication Flow Skill

> **AI INSTRUCTION**: Apply this rule when building login, signup, or gated content.

## Implementation Rules
- Never store plain text passwords. Ensure bcrypt or Argon2 is used.
- Send JWT tokens via HttpOnly, Secure cookies to prevent XSS attacks. 
- Do not store JWTs in \`localStorage\`.
`;
}

function generateGenericSkill(): string {
    return `# Example Blueprint Skill

> **AI INSTRUCTION**: This is an Executable Memory template.

- When instructed to build a feature, read the relevant \`.md\` file in this \`skills/\` folder before writing code.
- If no skill file exists for your task, you may generate one here to codify your architectural decisions so future AI agents remember how you built it.
`;
}
