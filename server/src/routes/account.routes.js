import { Router } from 'express';
import multer from 'multer';
import {
  allocateAccounts,
  createPromise,
  createSettlementOffer,
  getAccountDetails,
  importAccounts,
  listAccounts,
  logCall,
  recordPayment,
  reviewSettlementOffer,
} from '../controllers/account.controller.js';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { loadAccessibleAccount } from '../middleware/accountAccess.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.use(authenticate);
router.post('/allocations', requireRoles('head', 'coo', 'manager'), allocateAccounts);
router.post('/accounts/import', requireRoles('head', 'coo', 'manager'), upload.single('file'), importAccounts);
router.get('/accounts', listAccounts);
router.get('/accounts/:loanNo', loadAccessibleAccount, getAccountDetails);
router.post('/accounts/:loanNo/calls', loadAccessibleAccount, logCall);
router.post('/accounts/:loanNo/promises', loadAccessibleAccount, createPromise);
router.post('/accounts/:loanNo/settlements', requireRoles('head', 'coo', 'manager', 'caller'), loadAccessibleAccount, createSettlementOffer);
router.post('/accounts/:loanNo/settlements/:settlementId/decision', requireRoles('head', 'coo', 'manager'), loadAccessibleAccount, reviewSettlementOffer);
router.post('/accounts/:loanNo/payments', loadAccessibleAccount, recordPayment);

export default router;
