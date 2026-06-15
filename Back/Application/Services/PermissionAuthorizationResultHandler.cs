using System.Security.Claims;
using Back.Application.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;

namespace Back.Application.Services
{
    public class PermissionAuthorizationResultHandler : IAuthorizationMiddlewareResultHandler
    {
        private readonly AuthorizationMiddlewareResultHandler _defaultHandler = new();
        private readonly IServiceScopeFactory _scopeFactory;

        public PermissionAuthorizationResultHandler(IServiceScopeFactory scopeFactory)
        {
            _scopeFactory = scopeFactory;
        }

        public async Task HandleAsync(
            RequestDelegate next,
            HttpContext context,
            AuthorizationPolicy policy,
            PolicyAuthorizationResult authorizeResult)
        {
            var requirement = context.GetEndpoint()?.Metadata.GetMetadata<RequirePermissionAttribute>();
            if (requirement is null || !(context.User.Identity?.IsAuthenticated ?? false))
            {
                await _defaultHandler.HandleAsync(next, context, policy, authorizeResult);
                return;
            }

            if (!authorizeResult.Succeeded)
            {
                await _defaultHandler.HandleAsync(next, context, policy, authorizeResult);
                return;
            }

            var idValue = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(idValue, out var userId))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return;
            }

            using var scope = _scopeFactory.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<PermisosService>();
            var permissions = await service.ObtenerEfectivosAsync(userId);
            if (!permissions.Contains(requirement.Permission))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return;
            }

            await next(context);
        }
    }
}
