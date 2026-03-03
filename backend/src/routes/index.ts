import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { tasksRouter } from "./tasks.routes.js";
import { templatesRouter } from "./templates.routes.js";
import { reportsRouter } from "./reports.routes.js";
import { uploadsRouter } from "./uploads.routes.js";
import { usersRouter } from "./users.routes.js";
import { projectsRouter } from "./projects.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/tasks", tasksRouter);
apiRouter.use("/templates", templatesRouter);
apiRouter.use("/reports", reportsRouter);
apiRouter.use("/uploads", uploadsRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/projects", projectsRouter);