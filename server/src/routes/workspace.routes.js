import { Router } from 'express';
import { getCallerDetails, getDashboard, getNotifications, getSettlementRequests, getTeam, markNotificationRead } from '../controllers/workspace.controller.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.get('/dashboard', getDashboard);
router.get('/team', getTeam);
router.get('/team/:callerId', requireRoles('head', 'coo', 'manager'), getCallerDetails);
router.get('/settlements/requests', requireRoles('head'), getSettlementRequests);
router.get('/notifications', getNotifications);
router.patch('/notifications/:notificationId/read', markNotificationRead);

export default router;
