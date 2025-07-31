import { Router } from 'express';
import { CollaborationService } from '../services/CollaborationService';
import { CollaborationRepository } from '../repositories/CollaborationRepository';
import { authenticateToken } from '../middleware/auth';
import { PrismaClient, ProjectRole } from '../generated/prisma';

const router = Router();
const prisma = new PrismaClient();
const collaborationRepo = new CollaborationRepository(prisma);
const collaborationService = new CollaborationService(collaborationRepo);

// Get project collaborators
router.get('/projects/:projectId/collaborators', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;

    // Check if user has access to the project
    const hasAccess = await collaborationService.hasProjectAccess(projectId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const collaborators = await collaborationService.getProjectCollaborators(projectId);
    res.json({ collaborators });
  } catch (error) {
    console.error('Error getting collaborators:', error);
    res.status(500).json({ error: 'Failed to get collaborators' });
  }
});

// Invite collaborator
router.post('/projects/:projectId/collaborators', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userEmail, role } = req.body;
    const userId = req.user!.userId;

    // Check if user can manage collaborators
    const canManage = await collaborationService.canManageCollaborators(projectId, userId);
    if (!canManage) {
      return res.status(403).json({ error: 'No permission to manage collaborators' });
    }

    // Validate role
    if (!Object.values(ProjectRole).includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const collaborator = await collaborationService.inviteCollaborator(
      projectId,
      userEmail,
      role,
      userId
    );

    res.status(201).json({ collaborator });
  } catch (error) {
    console.error('Error inviting collaborator:', error);
    res.status(500).json({ error: 'Failed to invite collaborator' });
  }
});

// Update collaborator role
router.put('/projects/:projectId/collaborators/:collaboratorId', authenticateToken, async (req, res) => {
  try {
    const { projectId, collaboratorId } = req.params;
    const { role } = req.body;
    const userId = req.user!.userId;

    // Check if user can manage collaborators
    const canManage = await collaborationService.canManageCollaborators(projectId, userId);
    if (!canManage) {
      return res.status(403).json({ error: 'No permission to manage collaborators' });
    }

    // Validate role
    if (!Object.values(ProjectRole).includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const updatedCollaborator = await collaborationService.updateCollaboratorRole(
      projectId,
      collaboratorId,
      role
    );

    res.json({ collaborator: updatedCollaborator });
  } catch (error) {
    console.error('Error updating collaborator role:', error);
    res.status(500).json({ error: 'Failed to update collaborator role' });
  }
});

// Remove collaborator
router.delete('/projects/:projectId/collaborators/:collaboratorId', authenticateToken, async (req, res) => {
  try {
    const { projectId, collaboratorId } = req.params;
    const userId = req.user!.userId;

    // Check if user can manage collaborators
    const canManage = await collaborationService.canManageCollaborators(projectId, userId);
    if (!canManage) {
      return res.status(403).json({ error: 'No permission to manage collaborators' });
    }

    await collaborationService.removeCollaborator(projectId, collaboratorId);
    res.status(204).send();
  } catch (error) {
    console.error('Error removing collaborator:', error);
    res.status(500).json({ error: 'Failed to remove collaborator' });
  }
});

// Accept collaboration invitation
router.post('/projects/:projectId/collaborators/accept', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;

    const collaborator = await collaborationService.acceptInvitation(projectId, userId);
    res.json({ collaborator });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Get user's collaborations
router.get('/collaborations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const collaborations = await collaborationRepo.getUserCollaborations(userId);
    res.json({ collaborations });
  } catch (error) {
    console.error('Error getting collaborations:', error);
    res.status(500).json({ error: 'Failed to get collaborations' });
  }
});

// Get active sessions for a project
router.get('/projects/:projectId/sessions', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;

    // Check if user has access to the project
    const hasAccess = await collaborationService.hasProjectAccess(projectId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const sessions = await collaborationService.getActiveSessions(projectId);
    res.json({ sessions });
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// Get chat messages for a project
router.get('/projects/:projectId/chat', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Check if user has access to the project
    const hasAccess = await collaborationService.hasProjectAccess(projectId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await collaborationService.getChatMessages(projectId, limit, offset);
    res.json({ messages });
  } catch (error) {
    console.error('Error getting chat messages:', error);
    res.status(500).json({ error: 'Failed to get chat messages' });
  }
});

// Get collaboration history
router.get('/projects/:projectId/history', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 100;

    // Check if user has access to the project
    const hasAccess = await collaborationService.hasProjectAccess(projectId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const history = await collaborationService.getCollaborationHistory(projectId, limit);
    res.json({ history });
  } catch (error) {
    console.error('Error getting collaboration history:', error);
    res.status(500).json({ error: 'Failed to get collaboration history' });
  }
});

// Get user's project role
router.get('/projects/:projectId/role', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;

    const role = await collaborationService.getUserProjectRole(projectId, userId);
    if (!role) {
      return res.status(403).json({ error: 'No access to project' });
    }

    res.json({ role });
  } catch (error) {
    console.error('Error getting user role:', error);
    res.status(500).json({ error: 'Failed to get user role' });
  }
});

export default router;