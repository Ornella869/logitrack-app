using QRCoder;

namespace Back.Application.Services
{
    public class QrService
    {
        public const string PublicTrackingBaseUrl = "https://logitrack.com/seguimiento";

        public string BuildTrackingUrl(string codigoSeguimiento)
        {
            return $"{PublicTrackingBaseUrl}/{codigoSeguimiento}";
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
