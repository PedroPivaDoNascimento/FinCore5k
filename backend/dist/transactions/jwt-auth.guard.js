"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
let JwtAuthGuard = class JwtAuthGuard {
    constructor() {
        this.secret = process.env.TEST_JWT_SECRET ?? 'fincore-e2e-secret';
    }
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const auth = request.headers['authorization'];
        if (!auth || !auth.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('Bearer token JWT obrigatorio.');
        }
        const token = auth.slice('Bearer '.length).trim();
        const payload = this.verify(token);
        request.user = payload;
        return true;
    }
    verify(token) {
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new common_1.UnauthorizedException('JWT malformado.');
        }
        const [b64Header, b64Payload, b64Sig] = parts;
        let header;
        try {
            header = JSON.parse(Buffer.from(b64Header, 'base64url').toString());
        }
        catch {
            throw new common_1.UnauthorizedException('JWT malformado.');
        }
        if (header.alg !== 'HS256') {
            throw new common_1.UnauthorizedException('Algoritmo JWT nao suportado.');
        }
        const expectedSig = Buffer.from(require('node:crypto')
            .createHmac('sha256', this.secret)
            .update(`${b64Header}.${b64Payload}`)
            .digest());
        const providedSig = Buffer.from(b64Sig, 'base64url');
        if (providedSig.length !== expectedSig.length ||
            !require('node:crypto').timingSafeEqual(providedSig, expectedSig)) {
            throw new common_1.UnauthorizedException('Assinatura JWT invalida.');
        }
        let payload;
        try {
            payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString());
        }
        catch {
            throw new common_1.UnauthorizedException('JWT malformado.');
        }
        const exp = Number(payload.exp ?? 0);
        if (!exp || exp * 1000 < Date.now()) {
            throw new common_1.UnauthorizedException('JWT expirado.');
        }
        return payload;
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], JwtAuthGuard);
//# sourceMappingURL=jwt-auth.guard.js.map