import unittest
from fastapi import HTTPException
from app import canonical_media_url

class MediaURLTests(unittest.TestCase):
    def test_youtube(self):
        self.assertEqual(canonical_media_url("https://youtu.be/dQw4w9WgXcQ")[0], "youtube")
    def test_instagram(self):
        self.assertEqual(canonical_media_url("https://www.instagram.com/reel/C9abc_123/")[0], "instagram")
    def test_tiktok(self):
        self.assertEqual(canonical_media_url("https://www.tiktok.com/@example/video/7391123456789012345")[0], "tiktok")
    def test_tiktok_mobile(self):
        self.assertEqual(canonical_media_url("https://vm.tiktok.com/ZMexample/")[0], "tiktok")
    def test_blocked_hosts(self):
        for url in (
            "https://localhost/reel/ABC",
            "https://instagram.com.evil.example/reel/ABC",
            "https://user:pass@instagram.com/reel/ABC",
            "http://instagram.com/reel/ABC",
            "https://127.0.0.1/reel/ABC",
            "https://instagram.com:8080/reel/ABC",
            "https://www.instagram.com/stories/user/123",
            "https://www.tiktok.com/@example",
        ):
            with self.subTest(url=url), self.assertRaises(HTTPException):
                canonical_media_url(url)

if __name__ == "__main__":
    unittest.main()
