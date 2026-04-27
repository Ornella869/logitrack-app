namespace Back.Application.Abstractions
{
    public interface IRecaptchaValidationService
    {
        Task<bool> ValidateAsync(string token, string? remoteIp, CancellationToken cancellationToken = default);
    }
}
