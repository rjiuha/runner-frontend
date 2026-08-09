// src/lib/jwt.js

/**
 * Декодирует payload JWT БЕЗ проверки подписи.
 * Это нормально: подпись проверяет сервер, клиенту нужны только id/username
 * для отрисовки. Никаких решений о доступе на этих данных строить нельзя.
 */
function base64UrlDecode(input) {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const binary = globalThis.atob(padded);

    // atob отдаёт «байтовую строку». Кириллица в username — это UTF-8,
    // поэтому байты нужно собрать обратно в символы, иначе получим кракозябры.
    const percentEncoded = Array.from(binary, (ch) =>
        '%' + ch.charCodeAt(0).toString(16).padStart(2, '0'),
    ).join('');

    return decodeURIComponent(percentEncoded);
}

export function decodeJwt(token) {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;
        return JSON.parse(base64UrlDecode(payload));
    } catch {
        return null;
    }
}

/** Достаёт профиль из токена. Поля id/username добавляет JwtCreatedListener на беке. */
export function userFromToken(token) {
    const claims = decodeJwt(token);
    if (!claims) return null;

    return {
        id: claims.id ?? null,
        username: claims.username ?? claims.email ?? 'Игрок',
        email: claims.email ?? null,
        roles: claims.roles ?? [],
    };
}