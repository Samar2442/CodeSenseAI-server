"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const app_1 = __importDefault(require("./app"));
const prisma_1 = __importDefault(require("./lib/prisma"));
const logger_1 = require("./utils/logger");
dotenv_1.default.config();
const httpServer = (0, http_1.createServer)(app_1.default);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    }
});
io.on('connection', (socket) => {
    logger_1.logger.info(`Socket connected: ${socket.id}`);
    socket.on('disconnect', () => {
        logger_1.logger.info(`Socket disconnected: ${socket.id}`);
    });
});
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, async () => {
    try {
        await prisma_1.default.$connect();
        logger_1.logger.info('✅ Database connected successfully');
        logger_1.logger.info(`🚀 CodeSense AI Server running on port ${PORT}`);
    }
    catch (error) {
        logger_1.logger.error(`❌ Database connection failed: ${error}`);
    }
});
// Graceful shutdown
process.on('SIGINT', async () => {
    await prisma_1.default.$disconnect();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    await prisma_1.default.$disconnect();
    process.exit(0);
});
