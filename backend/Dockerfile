FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 ledger && mkdir -p /data/receipts && chown -R ledger /data
COPY --from=build /app/target/ledger-api-*.jar app.jar
USER ledger
ENV JAVA_OPTS="-Xms128m -Xmx384m"
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
