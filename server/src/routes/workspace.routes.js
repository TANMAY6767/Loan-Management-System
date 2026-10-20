import { Router } from 'express';
import { getDashboard, getNotifications, getSettlementRequests, getTeam, markNotificationRead } from '../controllers/workspace.controller.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.get('/dashboard', getDashboard);
router.get('/team', getTeam);
router.get('/settlements/requests', requireRoles('head', 'coo', 'manager'), getSettlementRequests);
router.get('/notifications', getNotifications);
router.patch('/notifications/:notificationId/read', markNotificationRead);

export default router;
