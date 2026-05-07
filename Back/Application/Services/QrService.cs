using QRCoder;

namespace Back.Application.Services
{
    public class QrService
    {
        private readonly string _publicTrackingBaseUrl;

        public QrService(IConfiguration configuration)
        {
            _publicTrackingBaseUrl = configuration["PublicTrackingBaseUrl"]?.Trim()
                ?? throw new InvalidOperationException("La configuración PublicTrackingBaseUrl es obligatoria.");
        }

        public string BuildTrackingUrl(string codigoSeguimiento)
        {
            var baseUrl = _publicTrackingBaseUrl.TrimEnd('/');
            var trackingId = Uri.EscapeDataString(codigoSeguimiento.Trim());
            return $"{baseUrl}/{trackingId}";
        }

        public byte[] GenerarPng(string codigoSeguimiento)
        {
            using var generator = new QRCodeGenerator();
            using var data = generator.CreateQrCode(BuildTrackingUrl(codigoSeguimiento), QRCodeGenerator.ECCLevel.Q);
            using var qr = new PngByteQRCode(data);
            return qr.GetGraphic(20);
        }

        public string GenerarBase64(string codigoSeguimiento)
        {
            var bytes = GenerarPng(codigoSeguimiento);
            return $"data:image/png;base64,{Convert.ToBase64String(bytes)}";
        }
    }
}
