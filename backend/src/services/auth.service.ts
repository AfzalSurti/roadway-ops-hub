import ms from "ms";
import { env } from "../config/env.js";
import { refreshTokenRepository } from "../repositories/refresh-token.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { comparePassword } from "../utils/password.js";
import { badRequest, unauthorized } from "../utils/errors.js";
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";

export const authService = {
  async login(email: string, password: string) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw unauthorized("Invalid email or password");
    }

    const validPassword = await comparePassword(password, user.passwordHash);
    if (!validPassword) {
      throw unauthorized("Invalid email or password");
    }

    const tokenPayload = {
      sub: user.id,
      role: user.role,
      email: user.email
    };

    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);
    const expiresAt = new Date(Date.now() + ms(env.JWT_REFRESH_EXPIRES_IN as ms.StringValue));

    await refreshTokenRepository.create({
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    };
  },

  async refresh(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);

    const storedToken = await refreshTokenRepository.findValidToken(tokenHash);
    if (!storedToken || storedToken.userId !== payload.sub) {
      throw unauthorized("Refresh token is invalid or revoked");
    }

    const accessToken = signAccessToken({
      sub: storedToken.user.id,
      role: storedToken.user.role,
      email: storedToken.user.email
    });

    return { accessToken };
  },

  async logout(refreshToken: string) {
    if (!refreshToken) {
      throw badRequest("refreshToken is required");
    }

    await refreshTokenRepository.revokeByHash(hashToken(refreshToken));
    return { loggedOut: true };
  }
};