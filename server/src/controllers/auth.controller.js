import * as authService from "../services/auth.service.js";

export const register = async (req, res) => {
  const data = await authService.register(req.body);
  res.status(201).json({ success: true, message: "Account created successfully", data });
};

export const login = async (req, res) => {
  const data = await authService.login(req.body);
  res.status(200).json({ success: true, message: "Logged in successfully", data });
};

export const me = async (req, res) => {
  const user = await authService.getUser(req.userId);
  res.status(200).json({ success: true, data: user });
};