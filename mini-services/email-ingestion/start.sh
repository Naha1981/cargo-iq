#!/bin/bash
# Start the CargoIQ Email Ingestion Mini-Service
trap '' SIGTERM SIGINT SIGHUP
cd /home/z/my-project/mini-services/email-ingestion
exec bun --hot index.ts
