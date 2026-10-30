# KerfScript command line in a container:
#
#   docker run --rm -v "$PWD:/work" --user "$(id -u):$(id -g)" \
#     ghcr.io/mylasertools/kerfscript render box.kerf
#
# --user runs kerf as you, so it can write box.svg into your folder.
#
# dist/cli.js is a single bundled file with no dependencies, so the image only
# needs Node.js.

FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:22-alpine
LABEL org.opencontainers.image.title="KerfScript" \
      org.opencontainers.image.description="A programming language for laser cutting" \
      org.opencontainers.image.source="https://github.com/mylasertools/kerfscript" \
      org.opencontainers.image.url="https://kerfscript.mylasertools.com" \
      org.opencontainers.image.licenses="AGPL-3.0-only"
COPY --from=build /src/dist/cli.js /opt/kerfscript/cli.js
COPY LICENSE COMMERCIAL-LICENSE.md THIRD-PARTY-NOTICES.md fonts/OFL.txt /opt/kerfscript/
RUN printf '#!/bin/sh\nexec node /opt/kerfscript/cli.js "$@"\n' > /usr/local/bin/kerf \
 && chmod +x /usr/local/bin/kerf
USER node
WORKDIR /work
ENTRYPOINT ["kerf"]
CMD ["--help"]
