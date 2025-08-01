-- Add performance indexes for better query optimization

-- User table indexes
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");
CREATE INDEX "users_updatedAt_idx" ON "users"("updatedAt");

-- Project table indexes
CREATE INDEX "projects_userId_idx" ON "projects"("userId");
CREATE INDEX "projects_userId_updatedAt_idx" ON "projects"("userId", "updatedAt");
CREATE INDEX "projects_createdAt_idx" ON "projects"("createdAt");
CREATE INDEX "projects_updatedAt_idx" ON "projects"("updatedAt");
CREATE INDEX "projects_name_idx" ON "projects"("name");

-- ProjectFile table indexes
CREATE INDEX "project_files_projectId_idx" ON "project_files"("projectId");
CREATE INDEX "project_files_projectId_type_idx" ON "project_files"("projectId", "type");
CREATE INDEX "project_files_updatedAt_idx" ON "project_files"("updatedAt");

-- PromptHistory table indexes
CREATE INDEX "prompt_history_projectId_idx" ON "prompt_history"("projectId");
CREATE INDEX "prompt_history_projectId_createdAt_idx" ON "prompt_history"("projectId", "createdAt");