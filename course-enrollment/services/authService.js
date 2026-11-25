const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const { httpError } = require('../utils/http');

const isText = (v) => typeof v === 'string' && v.trim() !== '';

async function register(body) {
  const { name, email, password, role } = body || {};
  if (![name, email, password, role].every(isText)) {
    throw httpError(400, 'name, email, password and role are required');
  }
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw httpError(400, 'email is not valid');
  if (password.length < 8) throw httpError(400, 'password must be at least 8 characters');
  if (!['student', 'instructor'].includes(role)) {
    throw httpError(400, 'role must be student or instructor');
  }
  try {
    return await userRepository.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: await bcrypt.hash(password, 10),
      role,
    });
  } catch (err) {
    if (err.code === '23505') throw httpError(409, 'Email is already registered');
    throw err;
  }
}

async function login(body) {
  const { email, password } = body || {};
  if (![email, password].every(isText)) {
    throw httpError(400, 'email and password are required');
  }
  const user = await userRepository.findByEmail(email.trim().toLowerCase());
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw httpError(401, 'Invalid email or password');
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

async function getMe(user) {
  const found = await userRepository.findById(user.id);
  if (!found) throw httpError(404, 'User not found');
  return found;
}

module.exports = { register, login, getMe };