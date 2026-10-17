# ReKnee AI — MCP Connection Specification

## MVP Decision
No MCP server is required for the core ReKnee AI MVP.

The MVP can be built with:
- AI coding agent;
- GitHub;
- Supabase;
- MediaPipe;
- optional server-side LLM API.

## Optional MCP Use
If the development environment supports an MCP server, use it only for a clearly defined capability such as repository inspection, documentation lookup, or controlled database development assistance.

## Requirements Before Connecting
Document:
- MCP server name;
- purpose;
- tools/resources exposed;
- minimum permissions;
- credentials required;
- environment variables;
- data accessible.

## Least Privilege
- Enable only required tools.
- Never provide production secrets unnecessarily.
- Never commit MCP credentials.
- Do not grant destructive database permissions for routine coding.

## Verification
A connection is considered successful only when the specific required tool is tested.

## Approval Required
Any MCP connection that can read/write production patient data requires explicit security approval and is out of MVP scope.
