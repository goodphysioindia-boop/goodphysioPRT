const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getPrtStats,
  setSessionAccessBulk,
} = require('../controllers/userController');

router.use(protect);

router.get('/prt-stats', authorize('admin', 'prt'), getPrtStats); // admin: all PRTs, PRT: own row only
router.get('/', getAllUsers);
router.get('/:id', getUserById);

router.post('/', authorize('admin'), createUser);
// Must stay above '/:id' so "session-access" is not read as a user id
router.put('/session-access', authorize('admin'), setSessionAccessBulk);
router.put('/:id', authorize('admin'), updateUser);
router.delete('/:id', authorize('admin'), deleteUser);

module.exports = router;