#!/usr/bin/env python3
"""
Database Backup and Restore Script

This script provides functionality to:
1. Backup PostgreSQL database to a file
2. Restore PostgreSQL database from a backup file

The script uses pg_dump for backups and psql for restoration.
"""

import os
import sys
import logging
import argparse
import subprocess
from datetime import datetime
from dotenv import load_dotenv

# Set up logging
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# Default backup directory
DEFAULT_BACKUP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backups')

# Get database connection details from environment variables or use defaults
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'karaoke')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'postgres')
DB_SCHEMA = os.getenv('DB_SCHEMA', 'karaoke')

class DatabaseBackupTool:
    def __init__(self, host=DB_HOST, port=DB_PORT, dbname=DB_NAME, 
                 user=DB_USER, password=DB_PASSWORD, schema=DB_SCHEMA):
        """Initialize the DatabaseBackupTool with connection parameters"""
        self.host = host
        self.port = port
        self.dbname = dbname
        self.user = user
        self.password = password
        self.schema = schema
        self.backup_dir = DEFAULT_BACKUP_DIR
        
        # Create backup directory if it doesn't exist
        os.makedirs(self.backup_dir, exist_ok=True)
    
    def backup(self, output_file=None, schema_only=False, include_data=True, compress=True):
        """
        Backup database to a file
        
        Args:
            output_file (str): Output file path. If None, a timestamped file will be created
            schema_only (bool): Whether to backup only the schema (no data)
            include_data (bool): Whether to include data in the backup
            compress (bool): Whether to compress the output using gzip
            
        Returns:
            str: Path to the backup file
        """
        try:
            # Set environment variables for pg_dump
            my_env = os.environ.copy()
            my_env['PGPASSWORD'] = self.password
            
            # Create timestamped filename if none provided
            if output_file is None:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"{self.dbname}_{timestamp}"
                if schema_only:
                    filename += "_schema"
                filename += ".sql"
                if compress:
                    filename += ".gz"
                output_file = os.path.join(self.backup_dir, filename)
            
            # Build the pg_dump command
            cmd = [
                'pg_dump',
                '--host', self.host,
                '--port', self.port,
                '--username', self.user,
                '--dbname', self.dbname,
                '--schema', self.schema
            ]
            
            # Add options based on parameters
            if schema_only:
                cmd.append('--schema-only')
            elif not include_data:
                cmd.append('--no-data')
                
            # For compressed output, pipe to gzip
            if compress:
                if output_file.endswith('.gz'):
                    # Remove .gz extension for pg_dump file output
                    pg_output = output_file[:-3]
                else:
                    pg_output = output_file
                    output_file += '.gz'
                
                pg_cmd = cmd + ['--file', pg_output]
                
                # Execute pg_dump
                logger.info(f"Running backup command: {' '.join(pg_cmd)}")
                result = subprocess.run(pg_cmd, env=my_env, 
                                       check=True, capture_output=True, text=True)
                
                # Compress the output
                logger.info(f"Compressing backup to {output_file}")
                gzip_cmd = ['gzip', '-f', pg_output]
                gzip_result = subprocess.run(gzip_cmd, check=True, capture_output=True, text=True)
                
                # Check if gzip created the expected file
                if not os.path.exists(output_file):
                    raise RuntimeError(f"Compression failed: {gzip_result.stderr}")
            else:
                # Direct output to file without compression
                cmd.extend(['--file', output_file])
                logger.info(f"Running backup command: {' '.join(cmd)}")
                result = subprocess.run(cmd, env=my_env,
                                       check=True, capture_output=True, text=True)
            
            logger.info(f"Backup completed successfully: {output_file}")
            return output_file
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Database backup failed: {e.stderr}")
            # Clean up any partial output files
            if output_file and os.path.exists(output_file):
                os.remove(output_file)
            raise RuntimeError(f"Database backup failed: {e.stderr}")
        
    def restore(self, input_file, schema_only=False, drop_existing=False):
        """
        Restore database from a backup file
        
        Args:
            input_file (str): Path to the backup file
            schema_only (bool): Whether to restore only the schema
            drop_existing (bool): Whether to drop existing schema before restore
            
        Returns:
            bool: True if restoration was successful
        """
        if not os.path.exists(input_file):
            raise FileNotFoundError(f"Backup file not found: {input_file}")
        
        try:
            # Set environment variables for psql
            my_env = os.environ.copy()
            my_env['PGPASSWORD'] = self.password
            
            # Check if the file is compressed
            is_compressed = input_file.endswith('.gz')
            
            if drop_existing:
                # First drop the schema if requested
                drop_cmd = [
                    'psql',
                    '--host', self.host,
                    '--port', self.port,
                    '--username', self.user,
                    '--dbname', self.dbname,
                    '-c', f'DROP SCHEMA IF EXISTS {self.schema} CASCADE; CREATE SCHEMA {self.schema};'
                ]
                
                logger.info(f"Dropping existing schema: {self.schema}")
                drop_result = subprocess.run(drop_cmd, env=my_env,
                                          check=True, capture_output=True, text=True)
            
            # Build the restore command
            if is_compressed:
                # For compressed files, use gunzip to pipe to psql
                cmd = f"gunzip -c {input_file} | psql --host {self.host} --port {self.port} " \
                      f"--username {self.user} --dbname {self.dbname}"
                
                logger.info(f"Running restore command: {cmd}")
                result = subprocess.run(cmd, env=my_env, shell=True,
                                      check=True, capture_output=True, text=True)
            else:
                # For uncompressed files, use psql directly
                cmd = [
                    'psql',
                    '--host', self.host,
                    '--port', self.port,
                    '--username', self.user,
                    # '--dbname', self.dbname,
                    '--file', input_file
                ]
                
                logger.info(f"Running restore command: {' '.join(cmd)}")
                result = subprocess.run(cmd, env=my_env,
                                      check=True, capture_output=True, text=True)
            
            logger.info(f"Restore completed successfully from: {input_file}")
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Database restore failed: {e.stderr if hasattr(e, 'stderr') else str(e)}")
            raise RuntimeError(f"Database restore failed: {e.stderr if hasattr(e, 'stderr') else str(e)}")
    
    def list_backups(self):
        """
        List all available backup files
        
        Returns:
            list: List of backup files with metadata
        """
        backup_files = []
        
        try:
            # Ensure backup directory exists
            if not os.path.exists(self.backup_dir):
                return []
                
            # List all files in the backup directory
            for filename in os.listdir(self.backup_dir):
                if filename.endswith('.sql') or filename.endswith('.sql.gz'):
                    file_path = os.path.join(self.backup_dir, filename)
                    file_stat = os.stat(file_path)
                    
                    # Extract metadata from filename and file stats
                    backup_info = {
                        'filename': filename,
                        'path': file_path,
                        'size': file_stat.st_size,
                        'created': datetime.fromtimestamp(file_stat.st_ctime).strftime("%Y-%m-%d %H:%M:%S"),
                        'is_compressed': filename.endswith('.gz'),
                        'is_schema_only': '_schema' in filename
                    }
                    backup_files.append(backup_info)
            
            # Sort by creation time (newest first)
            backup_files.sort(key=lambda x: x['created'], reverse=True)
            return backup_files
            
        except Exception as e:
            logger.error(f"Error listing backup files: {str(e)}")
            return []


def main():
    """Main entry point for the script"""
    parser = argparse.ArgumentParser(description='PostgreSQL Database Backup and Restore Tool')
    
    # Create subparsers for different commands
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    # Backup command
    backup_parser = subparsers.add_parser('backup', help='Backup the database')
    backup_parser.add_argument('-o', '--output', help='Output file path (default: timestamped file in backups directory)')
    backup_parser.add_argument('--schema-only', action='store_true', help='Backup only the schema, not the data')
    backup_parser.add_argument('--no-data', action='store_true', help='Exclude data from backup')
    backup_parser.add_argument('--no-compress', action='store_true', help='Do not compress the backup file')
    
    # Restore command
    restore_parser = subparsers.add_parser('restore', help='Restore database from backup')
    restore_parser.add_argument('-i', '--input', required=True, help='Input backup file path')
    restore_parser.add_argument('--schema-only', action='store_true', help='Restore only the schema')
    restore_parser.add_argument('--drop', action='store_true', help='Drop existing schema before restore')
    
    # List backups command
    list_parser = subparsers.add_parser('list', help='List available backups')
    
    # Parse arguments
    args = parser.parse_args()
    
    # Create backup tool
    backup_tool = DatabaseBackupTool()
    
    if args.command == 'backup':
        try:
            output_file = backup_tool.backup(
                output_file=args.output,
                schema_only=args.schema_only,
                include_data=not args.no_data,
                compress=not args.no_compress
            )
            print(f"Backup created successfully: {output_file}")
        except Exception as e:
            logger.exception(f"Error during backup: {str(e)}")
            sys.exit(1)
            
    elif args.command == 'restore':
        try:
            backup_tool.restore(
                input_file=args.input,
                schema_only=args.schema_only,
                drop_existing=args.drop
            )
            print(f"Restore completed successfully from: {args.input}")
        except Exception as e:
            print(f"Error during restore: {str(e)}")
            sys.exit(1)
            
    elif args.command == 'list':
        backup_files = backup_tool.list_backups()
        if backup_files:
            print(f"Found {len(backup_files)} backup files:")
            for i, backup in enumerate(backup_files, 1):
                size_mb = backup['size'] / (1024 * 1024)
                print(f"{i}. {backup['filename']}")
                print(f"   Created: {backup['created']}")
                print(f"   Size: {size_mb:.2f} MB")
                print(f"   Type: {'Schema only' if backup['is_schema_only'] else 'Full backup'}")
                print(f"   Compressed: {'Yes' if backup['is_compressed'] else 'No'}")
        else:
            print("No backup files found")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()