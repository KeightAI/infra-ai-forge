"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
var express_1 = require("express");
var supabase_js_1 = require("@supabase/supabase-js");
var child_process_1 = require("child_process");
var fs_1 = require("fs");
var path_1 = require("path");
var os_1 = require("os");
var app = (0, express_1.default)();
app.use(express_1.default.json());
// Environment variables
var SUPABASE_URL = process.env.SUPABASE_URL;
var SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
var POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '30000'); // 30 seconds default
var PORT = process.env.PORT || 8080;
// Initialize Supabase client
var supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_KEY);
// Update job status in database
function updateJobStatus(jobId, status, errorMessage) {
    return __awaiter(this, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, supabase
                        .from('deployment_jobs')
                        .update({
                        status: status,
                        error_message: errorMessage,
                        updated_at: new Date().toISOString(),
                    })
                        .eq('id', jobId)];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        console.error("Failed to update job ".concat(jobId, ":"), error);
                    }
                    return [2 /*return*/];
            }
        });
    });
}
// Execute shell command and log output
function executeCommand(command, cwd) {
    var _a, _b, _c;
    try {
        console.log("Executing: ".concat(command));
        var output = (0, child_process_1.execSync)(command, {
            cwd: cwd,
            encoding: 'utf-8',
            stdio: 'pipe',
            env: __assign(__assign({}, process.env), { 
                // Ensure AWS credentials are available
                AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY, AWS_REGION: process.env.AWS_REGION || 'us-east-1' }),
        });
        console.log(output);
        return output;
    }
    catch (error) {
        console.error("Command failed: ".concat(command));
        console.error((_a = error.stdout) === null || _a === void 0 ? void 0 : _a.toString());
        console.error((_b = error.stderr) === null || _b === void 0 ? void 0 : _b.toString());
        throw new Error(((_c = error.stderr) === null || _c === void 0 ? void 0 : _c.toString()) || error.message);
    }
}
// Clone repository and deploy to AWS using SST
function deployRepository(job) {
    return __awaiter(this, void 0, void 0, function () {
        var repoDir, branch, cloneCommand, stage, deployOutput, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    repoDir = null;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 5, 6]);
                    console.log("Starting deployment for job ".concat(job.id, ": ").concat(job.github_url));
                    // Create temporary directory
                    repoDir = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), 'repo-'));
                    console.log("Created temp directory: ".concat(repoDir));
                    branch = job.branch || 'main';
                    cloneCommand = "git clone --depth 1 --branch ".concat(branch, " ").concat(job.github_url, " ").concat(repoDir);
                    executeCommand(cloneCommand);
                    // Install dependencies
                    console.log('Installing dependencies...');
                    executeCommand('npm install', repoDir);
                    // Check if sst is installed locally, if not install globally
                    try {
                        executeCommand('npx sst version', repoDir);
                    }
                    catch (_b) {
                        console.log('SST not found, installing...');
                        executeCommand('npm install -g sst', repoDir);
                    }
                    stage = job.stage || 'production';
                    console.log("Deploying to stage: ".concat(stage));
                    deployOutput = executeCommand("npx sst deploy --stage ".concat(stage), repoDir);
                    // Update job as completed
                    return [4 /*yield*/, updateJobStatus(job.id, 'completed')];
                case 2:
                    // Update job as completed
                    _a.sent();
                    console.log("Successfully deployed job ".concat(job.id));
                    return [2 /*return*/, deployOutput];
                case 3:
                    error_1 = _a.sent();
                    console.error("Deployment failed for job ".concat(job.id, ":"), error_1.message);
                    return [4 /*yield*/, updateJobStatus(job.id, 'failed', error_1.message)];
                case 4:
                    _a.sent();
                    throw error_1;
                case 5:
                    // Cleanup: Remove temporary directory
                    if (repoDir) {
                        try {
                            (0, fs_1.rmSync)(repoDir, { recursive: true, force: true });
                            console.log("Cleaned up temp directory: ".concat(repoDir));
                        }
                        catch (cleanupError) {
                            console.error('Failed to cleanup temp directory:', cleanupError);
                        }
                    }
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// Poll database for pending jobs
function pollForJobs() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, jobs, error, job, error_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 4, , 5]);
                    console.log('Polling for pending jobs...');
                    return [4 /*yield*/, supabase
                            .from('deployment_jobs')
                            .select('*')
                            .eq('status', 'pending')
                            .order('created_at', { ascending: true })
                            .limit(1)];
                case 1:
                    _a = _b.sent(), jobs = _a.data, error = _a.error;
                    if (error) {
                        console.error('Error fetching jobs:', error);
                        return [2 /*return*/];
                    }
                    if (!jobs || jobs.length === 0) {
                        console.log('No pending jobs found');
                        return [2 /*return*/];
                    }
                    job = jobs[0];
                    console.log("Found pending job: ".concat(job.id));
                    // Update status to processing
                    return [4 /*yield*/, updateJobStatus(job.id, 'processing')];
                case 2:
                    // Update status to processing
                    _b.sent();
                    // Process the deployment
                    return [4 /*yield*/, deployRepository(job)];
                case 3:
                    // Process the deployment
                    _b.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _b.sent();
                    console.error('Error in polling cycle:', error_2);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
// Start polling
var pollingInterval;
function startPolling() {
    console.log("Starting polling with interval: ".concat(POLL_INTERVAL, "ms"));
    pollingInterval = setInterval(pollForJobs, POLL_INTERVAL);
    // Run immediately on start
    pollForJobs();
}
function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        console.log('Polling stopped');
    }
}
// Health check endpoint
app.get('/health', function (req, res) {
    res.json({ status: 'healthy', polling: !!pollingInterval });
});
// Manual trigger endpoint (optional)
app.post('/trigger', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, pollForJobs()];
            case 1:
                _a.sent();
                res.json({ success: true, message: 'Job polling triggered' });
                return [3 /*break*/, 3];
            case 2:
                error_3 = _a.sent();
                res.status(500).json({ error: error_3.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Start server and polling
app.listen(PORT, function () {
    console.log("Deployment worker running on port ".concat(PORT));
    startPolling();
});
// Graceful shutdown
process.on('SIGTERM', function () {
    console.log('SIGTERM received, shutting down gracefully...');
    stopPolling();
    process.exit(0);
});
process.on('SIGINT', function () {
    console.log('SIGINT received, shutting down gracefully...');
    stopPolling();
    process.exit(0);
});
