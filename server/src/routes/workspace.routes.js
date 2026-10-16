import { Router } from 'express';
import { getDashboard, getTeam } from '../controllers/workspace.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.get('/dashboard', getDashboard);
router.get('/team', getTeam);

export default router;
