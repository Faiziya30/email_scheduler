import { Router } from 'express';
import { scheduleDummyJob, getQueueStats } from '../controllers/testController';

const router = Router();

router.post('/schedule-dummy', scheduleDummyJob);
router.get('/jobs', getQueueStats);

export default router;
