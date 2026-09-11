import { Router } from 'express';
import multer from 'multer';
import { EmailController } from '../controllers/emailController';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

const router = Router();

router.post('/schedule', upload.single('file'), EmailController.schedule);
router.get('/scheduled', EmailController.getScheduled);
router.get('/sent', EmailController.getSent);
router.get('/search', EmailController.search);
router.delete('/:id', EmailController.deleteJob);

export default router;
