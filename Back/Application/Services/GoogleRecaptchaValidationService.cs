using System.Text.Json;
using System.Text.Json.Serialization;
using Back.Application.Abstractions;

namespace Back.Application.Services
{
    public class GoogleRecaptchaValidationService : IRecaptchaValidationService
    {
        private const string VerifyEndpoint = "https://www.google.com/recaptcha/api/siteverify";

        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<GoogleRecaptchaValidationService> _logger;

        public GoogleRecaptchaValidationService(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<GoogleRecaptchaValidationService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<bool> ValidateAsync(string token, string? remoteIp, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(token))
            {
                return false;
            }

            var secretKey = _configuration["GoogleReCaptcha:SecretKey"];
            if (string.IsNullOrWhiteSpace(secretKey))
            {
                _logger.LogError("No se encontró GoogleReCaptcha:SecretKey en la configuración del backend.");
                return false;
            }

            var payload = new Dictionary<string, string>
            {
                ["secret"] = secretKey,
                ["response"] = token,
            };

            if (!string.IsNullOrWhiteSpace(remoteIp))
            {
                payload["remoteip"] = remoteIp;
            }

            using var content = new FormUrlEncodedContent(payload);
            using var response = await _httpClient.PostAsync(VerifyEndpoint, content, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Google reCAPTCHA devolvió estado HTTP {StatusCode}.", (int)response.StatusCode);
                return false;
            }

            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = JsonSerializer.Deserialize<GoogleRecaptchaResponse>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
            });

            if (result?.Success != true)
            {
                var errors = result?.ErrorCodes is { Length: > 0 }
                    ? string.Join(", ", result.ErrorCodes)
                    : "sin detalles";

                _logger.LogInformation("Token de reCAPTCHA inválido. Errores: {Errors}", errors);
                return false;
            }

            return true;
        }

        private sealed class GoogleRecaptchaResponse
        {
            public bool Success { get; set; }

            [JsonPropertyName("error-codes")]
            public string[]? ErrorCodes { get; set; }
        }
    }
}
