#!/usr/bin/env node

import { Command } from 'commander';
import { CodeSlicer } from '../slicer';

const program = new Command();

program
  .name('monolith-slicer')
  .description('A tool for analyzing and slicing monolithic codebases')
  .version('0.1.0');

program
  .command('analyze <filepath>')
  .description('Analyze a codebase and show route information')
  .action(async (filepath: string) => {
    try {
      const slicer = new CodeSlicer();
      const code = await slicer.parseFile(filepath);
      const routes = slicer.extractRoutes(code);

      console.log('\n=== Route Analysis ===\n');
      for (const [serviceName, serviceRoutes] of Object.entries(routes)) {
        if (serviceRoutes.length > 0) {
          console.log(`${serviceName.toUpperCase()} Service:`);
          for (const route of serviceRoutes) {
            console.log(`  ${route.method.toUpperCase()} ${route.path}`);
          }
          console.log('');
        }
      }
    } catch (error) {
      console.error('Error analyzing file:', error);
      process.exit(1);
    }
  });

program
  .command('slice <filepath>')
  .description('Slice a monolith into microservices')
  .option('-o, --output <dir>', 'Output directory', './examples')
  .option('--no-docker', 'Skip Dockerfile generation')
  .action(async (filepath: string, options: { output: string; docker: boolean }) => {
    try {
      console.log(`\nSlicing monolith at: ${filepath}`);
      console.log(`Output directory: ${options.output}\n`);

      const slicer = new CodeSlicer({ generateDockerfiles: options.docker });
      await slicer.sliceMonolith(filepath, options.output);

      console.log('\n✓ Slicing complete!\n');
    } catch (error) {
      console.error('Error slicing monolith:', error);
      process.exit(1);
    }
  });

program.parse();

// Made with Bob
