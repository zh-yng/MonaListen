import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studioRouter from "./studio";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(studioRouter);
router.use(storageRouter);

export default router;
