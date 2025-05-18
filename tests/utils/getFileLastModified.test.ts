import fs from 'node:fs';
import { getFileLastModified } from '../../src/utils/getFileLastModified';

// Mock fs module
jest.mock('node:fs');

describe('getFileLastModified', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return the modification time for an existing file', () => {
    // Create a mock date for the file's mtime
    const mockDate = new Date('2023-01-01T12:00:00Z');
    
    // Mock the fs.statSync to return our mock date
    (fs.statSync as jest.Mock).mockReturnValue({
      mtime: mockDate
    });

    const filePath = '/path/to/existing/file.json';
    const result = getFileLastModified(filePath);

    expect(fs.statSync).toHaveBeenCalledWith(filePath);
    expect(result).toEqual(mockDate);
  });

  test('should return null if the file does not exist', () => {
    // Mock fs.statSync to throw an error (file not found)
    (fs.statSync as jest.Mock).mockImplementation(() => {
      throw new Error('File not found');
    });

    const filePath = '/path/to/non-existent/file.json';
    const result = getFileLastModified(filePath);

    expect(fs.statSync).toHaveBeenCalledWith(filePath);
    expect(result).toBeNull();
  });

  test('should handle any type of error and return null', () => {
    // Mock fs.statSync to throw a different type of error
    (fs.statSync as jest.Mock).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const filePath = '/path/to/unreadable/file.json';
    const result = getFileLastModified(filePath);

    expect(fs.statSync).toHaveBeenCalledWith(filePath);
    expect(result).toBeNull();
  });
});
