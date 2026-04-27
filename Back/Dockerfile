# Usa el SDK de .NET 10 para compilar
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# 1. Copia el archivo de proyecto específico (ahora se llama Back.csproj)
COPY ["Back.csproj", "./"]
RUN dotnet restore "Back.csproj"

# 2. Copia el resto de los archivos de la carpeta Back
COPY . .

# 3. Compila el proyecto generando el ejecutable
RUN dotnet publish "Back.csproj" -c Release -o /app/publish

# Etapa de ejecución
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .

# Configuración de puerto para Render
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

# 4. El punto de entrada debe coincidir con el nombre del proyecto
ENTRYPOINT ["dotnet", "Back.dll"]
