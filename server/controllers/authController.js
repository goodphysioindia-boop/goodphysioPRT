const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const sanitize = (user) => {
  const obj = user.toObject ? user.toObject() : user;
  delete obj.password;
  return obj;
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { loginEmail, password } = req.body;
    if (!loginEmail || !password) {
      return res.status(400).json({ message: 'Login email and password are required' });
    }

    const user = await User.findOne({ loginEmail: loginEmail.toLowerCase().trim() }).select('+password');
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    if (user.isInactive) {
      return res.status(403).json({ message: 'Your account has been deactivated. Contact your admin.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    const token = signToken(user);
    res.json({ token, user: sanitize(user) });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json({ user: req.user });
};

// PUT /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect' });

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Could not change password', error: err.message });
  }
};

// PUT /api/auth/profile-picture   body: { url }  (empty url removes the picture)
// Any logged-in user can change their OWN picture; the image itself is uploaded first
// through POST /api/uploads?purpose=profile-pictures.
exports.updateProfilePicture = async (req, res) => {
  try {
    const url = typeof req.body.url === 'string' ? req.body.url.trim() : '';
    if (url && !/^https:\/\//i.test(url)) {
      return res.status(400).json({ message: 'Invalid image address' });
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.profilePicture = url;
    await user.save();
    res.json({ user: sanitize(user) });
  } catch (err) {
    res.status(500).json({ message: 'Could not update profile picture', error: err.message });
  }
};