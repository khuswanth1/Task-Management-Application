package com.todo.app.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.todo.app.entity.User;
import com.todo.app.repository.UserRepository;
import com.todo.app.util.JwtUtil;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/settings")
@CrossOrigin(origins = "*")
@Tag(name = "Settings API", description = "Dedicated APIs for updating user profile and theme configurations")
public class SettingsController {

    private final UserRepository userRepository;

    public SettingsController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @PutMapping("/profile")
    @Operation(summary = "Update Profile Settings", description = "Updates general profile information of the user")
    public ResponseEntity<User> updateProfile(
            @RequestHeader(value = "Authorization", required = false) String token,
            @RequestBody User profileData) {
        
        if (token == null || !token.startsWith("Bearer ")) {
            throw new RuntimeException("Missing or invalid Authorization header");
        }
        String email = JwtUtil.validate(token.replace("Bearer ", ""));
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (profileData.getName() != null) user.setName(profileData.getName());
        if (profileData.getAge() != null) user.setAge(profileData.getAge());
        if (profileData.getGender() != null) user.setGender(profileData.getGender());
        if (profileData.getMobile() != null) user.setMobile(profileData.getMobile());
        if (profileData.getDob() != null) user.setDob(profileData.getDob());
        if (profileData.getProfileImage() != null) user.setProfileImage(profileData.getProfileImage());

        User saved = userRepository.save(user);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/theme")
    @Operation(summary = "Update Theme Settings", description = "Updates user-specific custom interface colors and typography settings")
    public ResponseEntity<User> updateTheme(
            @RequestHeader(value = "Authorization", required = false) String token,
            @RequestBody User themeData) {
        
        if (token == null || !token.startsWith("Bearer ")) {
            throw new RuntimeException("Missing or invalid Authorization header");
        }
        String email = JwtUtil.validate(token.replace("Bearer ", ""));
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Copy theme properties
        user.setPrimaryColor(themeData.getPrimaryColor());
        user.setBgColor(themeData.getBgColor());
        user.setSidebarColor(themeData.getSidebarColor());
        user.setCardColor(themeData.getCardColor());
        user.setHeadingColor(themeData.getHeadingColor());
        user.setTextColor(themeData.getTextColor());
        user.setButtonBgColor(themeData.getButtonBgColor());
        user.setButtonTextColor(themeData.getButtonTextColor());
        user.setFontSize(themeData.getFontSize());
        user.setFontFamily(themeData.getFontFamily());
        user.setBorderRadius(themeData.getBorderRadius());
        // Background image: absent (null) = keep the current one, "" = remove it.
        // Quick theme switches (header menu, mode buttons) don't resend the large image.
        if (themeData.getLogoImage() != null) user.setLogoImage(themeData.getLogoImage());
        user.setEnableFontFamily(themeData.getEnableFontFamily());
        user.setEnableFontSize(themeData.getEnableFontSize());
        user.setEnableBorderRadius(themeData.getEnableBorderRadius());
        user.setEnableColors(themeData.getEnableColors());

        User saved = userRepository.save(user);
        return ResponseEntity.ok(saved);
    }
}
