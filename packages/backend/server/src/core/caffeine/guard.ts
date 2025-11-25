import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class CaffeineAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secretHeader = request.headers['x-caffeine-secret'];

    // In a real app, we'd inject ConfigService, but for now accessing process.env directly
    // or through the global env object if available is common in this codebase.
    // However, best practice is to use the Config service if possible.
    // Looking at other files, `Config` is injected.

    // We'll check process.env for simplicity as the Config object structure is complex
    // and we haven't added this key to it yet.
    const expectedSecret = process.env.CAFFEINE_API_SECRET;

    console.log('CaffeineAuthGuard: Checking secret');
    console.log(`CaffeineAuthGuard: Header present: ${!!secretHeader}`);
    console.log(`CaffeineAuthGuard: Env var present: ${!!expectedSecret}`);
    if (expectedSecret) {
      console.log(
        `CaffeineAuthGuard: Secrets match: ${secretHeader === expectedSecret}`
      );
    }

    if (!expectedSecret) {
      console.error('CaffeineAuthGuard: CAFFEINE_API_SECRET is not set');
      throw new UnauthorizedException('API configuration error');
    }

    if (secretHeader !== expectedSecret) {
      console.error('CaffeineAuthGuard: Invalid secret provided');
      throw new UnauthorizedException('Invalid Caffeine Secret');
    }

    return true;
  }
}
