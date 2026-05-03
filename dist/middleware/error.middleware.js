"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    logger_1.logger.error(`[${req.method}] ${req.url} >> StatusCode:: ${statusCode}, Message:: ${message}`);
    res.status(statusCode).json({
        status: 'error',
        statusCode,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};
exports.errorHandler = errorHandler;
const notFoundHandler = (req, res, next) => {
    logger_1.logger.warn(`[${req.method}] ${req.url} >> Route not found`);
    res.status(404).json({ message: 'Route not found' });
};
exports.notFoundHandler = notFoundHandler;
