# Notification System with Auto-Dismiss

## Overview

The notification system in the aztec-bridge-and-seek repository has been enhanced with auto-dismiss functionality. Notifications now automatically close after a specified timeout, providing a better user experience.

## Features

### Auto-Dismiss Functionality
- **Success/Info messages**: Auto-dismiss after 4-5 seconds
- **Error messages**: Auto-dismiss after 8-10 seconds
- **Warning messages**: Auto-dismiss after 6 seconds
- **Manual dismissal**: Users can still manually close notifications by clicking the × button

### Visual Enhancements
- **Smooth animations**: Notifications slide in from the top with fade-in effect
- **Progress bar**: Visual indicator showing time remaining before auto-dismiss
- **Color-coded progress bars**: Different colors for different message types
- **Smooth exit animations**: Notifications slide out when dismissed

### Configuration Options
- `autoDismiss`: Boolean flag to enable/disable auto-dismiss (default: true)
- `dismissTimeout`: Custom timeout in milliseconds
- Default timeouts:
  - Info messages: 5000ms (5 seconds)
  - Error messages: 10000ms (10 seconds)

## Implementation Details

### ErrorProvider Updates
The `ErrorProvider` has been enhanced with:
- Timeout management using `useRef` and `useEffect`
- Automatic cleanup of timeouts on component unmount
- Support for custom dismiss timeouts per notification

### StatusMessage Component Updates
The `StatusMessage` component now includes:
- Smooth enter/exit animations
- Progress bar visualization
- Better state management for visible notifications

### CSS Enhancements
New CSS classes and animations:
- `.status-message.visible` / `.status-message.hidden` for animations
- `.dismiss-progress` and `.dismiss-progress-bar` for progress indicators
- `@keyframes dismiss-progress` for progress bar animation

## Usage Examples

### Basic Usage
```typescript
// Success message (auto-dismisses in 4 seconds)
addError({
  message: 'Successfully minted tokens',
  type: 'info',
  source: 'dripper',
  autoDismiss: true,
  dismissTimeout: 4000
});

// Error message (auto-dismisses in 8 seconds)
addError({
  message: 'Failed to mint tokens',
  type: 'error',
  source: 'dripper',
  details: 'Additional error details',
  autoDismiss: true,
  dismissTimeout: 8000
});
```

### Disable Auto-Dismiss
```typescript
// Persistent notification (no auto-dismiss)
addError({
  message: 'Important system message',
  type: 'warning',
  source: 'system',
  autoDismiss: false
});
```

### Custom Timeout
```typescript
// Custom timeout of 15 seconds
addError({
  message: 'Custom timeout message',
  type: 'info',
  source: 'custom',
  autoDismiss: true,
  dismissTimeout: 15000
});
```

## Updated Components

The following components have been updated to use the new auto-dismiss functionality:

1. **DripperCard**: Success and error messages for token minting operations
2. **useVoting hook**: Success and error messages for voting operations

## Testing

A test file `test-notifications.html` has been created to demonstrate the notification system functionality. You can open this file in a browser to test:

- Different notification types (success, error, warning, info)
- Auto-dismiss functionality with different timeouts
- Manual dismissal
- Progress bar visualization
- Smooth animations

## Migration Notes

### Backward Compatibility
- All existing notifications will continue to work
- Default behavior is auto-dismiss enabled
- Manual dismissal still works as before

### Breaking Changes
- None - the API remains the same
- New optional parameters (`autoDismiss`, `dismissTimeout`) have sensible defaults

## Future Enhancements

Potential improvements for the notification system:
- Pause auto-dismiss on hover
- Sound notifications
- Notification stacking limits
- Different animation styles
- Mobile-optimized notifications