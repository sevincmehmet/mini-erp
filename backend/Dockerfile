# Mini-ERP API — çok aşamalı derleme (yalnızca çalışma zamanı imajı sunucuya gider)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY src/MiniErp.Domain/MiniErp.Domain.csproj src/MiniErp.Domain/
COPY src/MiniErp.Application/MiniErp.Application.csproj src/MiniErp.Application/
COPY src/MiniErp.Infrastructure/MiniErp.Infrastructure.csproj src/MiniErp.Infrastructure/
COPY src/MiniErp.Api/MiniErp.Api.csproj src/MiniErp.Api/
RUN dotnet restore src/MiniErp.Api/MiniErp.Api.csproj
COPY src/ src/
RUN dotnet publish src/MiniErp.Api/MiniErp.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    Https__Redirect=false
EXPOSE 8080
# Root olmayan kullanıcı (imajda hazır gelir)
USER $APP_UID
ENTRYPOINT ["dotnet", "MiniErp.Api.dll"]
