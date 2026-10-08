package com.todo.app.config;

import com.todo.app.entity.User;
import com.todo.app.repository.UserRepository;
import com.todo.app.util.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Optional;

@Component
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final UserRepository userRepository;

    public OAuth2SuccessHandler(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException {
        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
        String email = oAuth2User.getAttribute("email");
        String name = oAuth2User.getAttribute("name");

        String picture = oAuth2User.getAttribute("picture");

        // Check if user exists, otherwise create
        Optional<User> userOptional = userRepository.findByEmail(email);
        if (userOptional.isEmpty()) {
            User newUser = new User();
            newUser.setEmail(email);
            newUser.setName(name);
            newUser.setUsername(email); // Use email as username for social login
            newUser.setRole("USER");
            newUser.setProfileImage(picture);
            userRepository.save(newUser);
        }

        // Generate JWT
        String token = JwtUtil.generate(email);

        // Redirect to frontend: use FRONTEND_URL env var (set on Render), fallback to localhost for dev
        String frontendUrl = System.getenv("FRONTEND_URL") != null
                ? System.getenv("FRONTEND_URL")
                : "http://localhost:5173";
        String targetUrl = frontendUrl + "/?token=" + token;
        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }
}
