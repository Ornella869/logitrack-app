using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Back.Domain.Models;
using Microsoft.IdentityModel.Tokens;

namespace Back.Application.Util
{
    public class JWTservice
    {
        public static string GenerateToken(Usuario usuario)
        {

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
                new Claim(ClaimTypes.Name, $"{usuario.Nombre}"),
                new Claim(ClaimTypes.Email, usuario.Email),
                new Claim(ClaimTypes.Role, usuario.GetType().Name),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("Grupo8SuperSecretKeyWithAtLeast32Characters"));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: "LogiTrack",
                audience: "LogiTrack",
                claims: claims,
                expires: DateTime.Now.AddHours(8),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}