const express = require('express');
const router = express.Router();
const { login, getMe, changePassword, updateProfilePicture } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);
router.put('/profile-picture', protect, updateProfilePicture); // every role, own picture only

module.exports = router;