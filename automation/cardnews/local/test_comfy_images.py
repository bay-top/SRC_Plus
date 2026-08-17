from __future__ import annotations

import unittest

from generate_comfy_images import workflow


class ComfyWorkflowTest(unittest.TestCase):
    def test_workflow_has_single_latent_and_save_node(self) -> None:
        graph = workflow("bridge", "text", "checkpoint.safetensors", 1, 512, 704, 20, 5.0)
        self.assertEqual("EmptyLatentImage", graph["4"]["class_type"])
        self.assertEqual([512, 704], [graph["4"]["inputs"]["width"], graph["4"]["inputs"]["height"]])
        self.assertEqual("SaveImage", graph["7"]["class_type"])


if __name__ == "__main__":
    unittest.main()
