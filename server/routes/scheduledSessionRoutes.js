const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  requireScheduler,
  getScheduledSessions,
  getScheduledSessionById,
  createScheduledSession,
  updateScheduledSession,
  deleteScheduledSession,
} = require('../controllers/scheduledSessionController');

router.use(protect);

// Reads: visibility is scoped per role inside the controller — you only get
// sessions you created or were selected for (admin sees everything).
router.get('/', getScheduledSessions);
router.get('/:id', getScheduledSessionById);

// Writes: admin, or a PRT/doctor an admin has allowed to schedule sessions.
router.post('/', requireScheduler, createScheduledSession);
router.put('/:id', requireScheduler, updateScheduledSession);
router.delete('/:id', requireScheduler, deleteScheduledSession);

module.exports = router;