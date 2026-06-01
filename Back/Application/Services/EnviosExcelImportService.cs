using System.Globalization;
using System.IO.Compression;
using System.Security;
using System.Text;
using System.Xml.Linq;
using Back.Controllers;
using Back.Domain.Models;

namespace Back.Application.Services
{
    public record ImportarEnvioRow(int Fila, RegistrarPaqueteRequest Request);

    public class EnviosExcelImportService
    {
        public static readonly string[] Headers =
        {
            "DestinatarioNombre", "DestinatarioApellido", "ModalidadEntrega", "PuntoPickUpId",
            "DestinatarioDireccion", "DestinatarioLocalidad", "DestinatarioCP", "DestinatarioProvincia", "DestinatarioTelefono", "DestinatarioEmail",
            "Peso", "TipoEnvio", "TipoPaquete", "Comentarios"
        };

        public byte[] GenerarTemplate()
        {
            using var ms = new MemoryStream();
            using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, true))
            {
                Add(zip, "[Content_Types].xml",
                    """<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>""");
                Add(zip, "_rels/.rels",
                    """<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>""");
                Add(zip, "xl/workbook.xml",
                    """<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Envios" sheetId="1" r:id="rId1"/></sheets></workbook>""");
                Add(zip, "xl/_rels/workbook.xml.rels",
                    """<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>""");
                Add(zip, "xl/worksheets/sheet1.xml", BuildSheetXml());
            }
            return ms.ToArray();
        }

        public async Task<List<ImportarEnvioRow>> ParseAsync(IFormFile file)
        {
            await using var stream = file.OpenReadStream();
            if (file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
                return ParseXlsx(stream);
            return ParseCsv(stream);
        }

        private static string BuildSheetXml()
        {
            var headerCells = string.Join("", Headers.Select((h, i) => Cell(i + 1, 1, h)));
            var sample = new[]
            {
                "Cliente", "Demo", "Domicilio", "",
                "Republica 500", "San Fernando del Valle de Catamarca", "4700", "Catamarca", "3834551111", "cliente@demo.com",
                "4.5", "Comun", "Comun", "Fila de ejemplo"
            };
            var sampleCells = string.Join("", sample.Select((h, i) => Cell(i + 1, 2, h)));
            return $"""<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">{headerCells}</row><row r="2">{sampleCells}</row></sheetData></worksheet>""";
        }

        private static string Cell(int col, int row, string value)
        {
            var reference = $"{ColumnName(col)}{row}";
            return $"""<c r="{reference}" t="inlineStr"><is><t>{SecurityElement.Escape(value)}</t></is></c>""";
        }

        private static string ColumnName(int index)
        {
            var name = string.Empty;
            while (index > 0)
            {
                index--;
                name = (char)('A' + index % 26) + name;
                index /= 26;
            }
            return name;
        }

        private static void Add(ZipArchive zip, string path, string content)
        {
            var entry = zip.CreateEntry(path);
            using var writer = new StreamWriter(entry.Open(), Encoding.UTF8);
            writer.Write(content);
        }

        private static List<ImportarEnvioRow> ParseCsv(Stream stream)
        {
            using var reader = new StreamReader(stream, Encoding.UTF8, true);
            var lines = reader.ReadToEnd().Split('\n').Select(l => l.Trim('\r')).Where(l => l.Length > 0).ToList();
            if (lines.Count <= 1) return new List<ImportarEnvioRow>();
            var headers = SplitCsv(lines[0]);
            return lines.Skip(1)
                .Select((line, i) => ToRow(i + 2, headers, SplitCsv(line)))
                .Where(r => r is not null)
                .Cast<ImportarEnvioRow>()
                .ToList();
        }

        private static List<ImportarEnvioRow> ParseXlsx(Stream stream)
        {
            using var zip = new ZipArchive(stream, ZipArchiveMode.Read, true);
            var shared = ReadSharedStrings(zip);
            var sheet = zip.GetEntry("xl/worksheets/sheet1.xml") ?? throw new InvalidOperationException("El Excel no contiene la hoja esperada.");
            using var sheetStream = sheet.Open();
            var doc = XDocument.Load(sheetStream);
            XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            var rows = doc.Descendants(ns + "row").ToList();
            if (rows.Count <= 1) return new List<ImportarEnvioRow>();
            var headers = ReadRow(rows[0], ns, shared);
            return rows.Skip(1)
                .Select(r => ToRow(int.TryParse(r.Attribute("r")?.Value, out var rowNum) ? rowNum : 0, headers, ReadRow(r, ns, shared)))
                .Where(r => r is not null)
                .Cast<ImportarEnvioRow>()
                .ToList();
        }

        private static List<string> ReadRow(XElement row, XNamespace ns, List<string> shared)
        {
            var cells = new SortedDictionary<int, string>();
            foreach (var cell in row.Elements(ns + "c"))
            {
                var refValue = cell.Attribute("r")?.Value ?? string.Empty;
                var col = ColumnIndex(new string(refValue.TakeWhile(char.IsLetter).ToArray()));
                var type = cell.Attribute("t")?.Value;
                var value = type switch
                {
                    "s" => int.TryParse(cell.Element(ns + "v")?.Value, out var idx) && idx >= 0 && idx < shared.Count ? shared[idx] : string.Empty,
                    "inlineStr" => cell.Descendants(ns + "t").FirstOrDefault()?.Value ?? string.Empty,
                    _ => cell.Element(ns + "v")?.Value ?? string.Empty,
                };
                cells[col] = value;
            }

            return Enumerable.Range(1, cells.Count == 0 ? 0 : cells.Keys.Max())
                .Select(i => cells.TryGetValue(i, out var value) ? value : string.Empty)
                .ToList();
        }

        private static List<string> ReadSharedStrings(ZipArchive zip)
        {
            var entry = zip.GetEntry("xl/sharedStrings.xml");
            if (entry is null) return new List<string>();
            using var stream = entry.Open();
            var doc = XDocument.Load(stream);
            XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            return doc.Descendants(ns + "si").Select(si => string.Concat(si.Descendants(ns + "t").Select(t => t.Value))).ToList();
        }

        private static int ColumnIndex(string letters)
        {
            var sum = 0;
            foreach (var c in letters.ToUpperInvariant())
                sum = sum * 26 + c - 'A' + 1;
            return sum;
        }

        private static List<string> SplitCsv(string line) => line.Split(';').Select(x => x.Trim().Trim('"')).ToList();

        private static ImportarEnvioRow? ToRow(int fila, List<string> headers, List<string> values)
        {
            if (values.All(string.IsNullOrWhiteSpace)) return null;
            string Get(string name)
            {
                var idx = headers.FindIndex(h => string.Equals(h, name, StringComparison.OrdinalIgnoreCase));
                return idx >= 0 && idx < values.Count ? values[idx].Trim() : string.Empty;
            }

            if (!double.TryParse(Get("Peso").Replace(',', '.'), NumberStyles.Number, CultureInfo.InvariantCulture, out var peso))
                peso = 0;

            Enum.TryParse<TipoEnvio>(Get("TipoEnvio"), true, out var tipoEnvio);
            Enum.TryParse<TipoPaquete>(Get("TipoPaquete"), true, out var tipoPaquete);
            Guid? puntoPickUpId = Guid.TryParse(Get("PuntoPickUpId"), out var pickupId) ? pickupId : null;

            return new ImportarEnvioRow(fila, new RegistrarPaqueteRequest
            {
                Peso = peso,
                TipoEnvio = tipoEnvio,
                TipoPaquete = tipoPaquete,
                Comentarios = Get("Comentarios"),
                Remitente = new RegistrarClienteRequest
                {
                    Nombre = "Sucursal",
                    Apellido = "Origen",
                    Direccion = string.Empty,
                    Localidad = string.Empty,
                    CP = string.Empty,
                },
                Destinatario = new RegistrarClienteRequest
                {
                    Nombre = Get("DestinatarioNombre"),
                    Apellido = Get("DestinatarioApellido"),
                    Direccion = Get("DestinatarioDireccion"),
                    Localidad = Get("DestinatarioLocalidad"),
                    CP = Get("DestinatarioCP"),
                    Provincia = Get("DestinatarioProvincia"),
                    Telefono = Get("DestinatarioTelefono"),
                    Email = Get("DestinatarioEmail"),
                },
                PuntoPickUpId = puntoPickUpId,
            });
        }
    }
}
