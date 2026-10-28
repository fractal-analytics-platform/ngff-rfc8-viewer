"""Regenerates every example (`uv run examples-all`)."""

from rfc8_examples import example1, example2, example3, example4, example5


def main():
    for module in (example1, example2, example4, example5, example3):
        print(f"generating {module.__name__.rsplit('.', 1)[-1]}")
        module.main()


if __name__ == "__main__":
    main()
